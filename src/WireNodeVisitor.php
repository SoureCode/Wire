<?php

namespace SoureCode\Wire;

use Twig\Environment;
use Twig\Node\EmbedNode;
use Twig\Node\Expression\ConstantExpression;
use Twig\Node\IncludeNode;
use Twig\Node\ModuleNode;
use Twig\Node\Node;
use Twig\Node\Nodes;
use Twig\Node\PrintNode;
use Twig\Node\TextNode;
use Twig\NodeVisitor\NodeVisitorInterface;

class WireNodeVisitor implements NodeVisitorInterface
{
    private string $currentTemplate = '';
    /** @var array<string, array<string, true>> */
    private array $templatePaths = [];
    private array $templateOptIn = [];
    private array $templateCascade = [];
    private array $cascadeChildren = [];
    private static array $globalCascadeChildren = [];

    public static function resetCascade(): void
    {
        self::$globalCascadeChildren = [];
    }

    public function enterNode(Node $node, Environment $env): Node
    {
        if ($node instanceof ModuleNode) {
            $this->currentTemplate = $node->getTemplateName();
            $this->templatePaths[$this->currentTemplate] = [];
        }

        return $node;
    }

    public function leaveNode(Node $node, Environment $env): ?Node
    {
        if ($node instanceof WireOptInNode) {
            $this->templateOptIn[$this->currentTemplate] = true;
            if ($node->getAttribute('cascade')) {
                $this->templateCascade[$this->currentTemplate] = true;
            }
        }

        if ($node instanceof PrintNode) {
            foreach ($this->collectPaths($node->getNode('expr')) as $path) {
                $this->templatePaths[$this->currentTemplate][$path] = true;
            }
        }

        if (!empty($this->templateCascade[$this->currentTemplate])) {
            if ($node instanceof IncludeNode && !($node instanceof EmbedNode)) {
                $expr = $node->getNode('expr');
                if ($expr instanceof ConstantExpression) {
                    $childName = $expr->getAttribute('value');
                    $this->cascadeChildren[$childName] = true;
                    $this->templateCascade[$childName] = true;
                    self::$globalCascadeChildren[$childName] = true;
                }
            }
        }

        if ($node instanceof ModuleNode) {
            $templateName = $node->getTemplateName();
            $paths = array_keys($this->templatePaths[$templateName] ?? []);
            $optedIn = !empty($this->templateOptIn[$templateName])
                || !empty($this->cascadeChildren[$templateName])
                || !empty(self::$globalCascadeChildren[$templateName]);

            if (!empty($paths) && $optedIn) {
                $this->wrapTextContentPrints($node);

                $node->setNode('display_start', new Nodes([
                    new WireScopeStartNode($templateName, $paths, $node->getTemplateLine()),
                    $node->getNode('display_start'),
                ]));
                $node->setNode('display_end', new Nodes([
                    $node->getNode('display_end'),
                    new WireScopeEndNode($templateName, $node->getTemplateLine()),
                ]));
            }

            if (!empty($this->templateCascade[$templateName])) {
                foreach ($node->getAttribute('embedded_templates') as $embedded) {
                    $parentExpr = $embedded->getNode('parent');
                    if ($parentExpr instanceof ConstantExpression) {
                        $childName = $parentExpr->getAttribute('value');
                        $this->cascadeChildren[$childName] = true;
                        $this->templateCascade[$childName] = true;
                        self::$globalCascadeChildren[$childName] = true;
                    }
                }
            }
        }

        return $node;
    }

    /**
     * Walk the AST in document order and replace every text-content PrintNode
     * with a Nodes wrapper that emits comment markers around the original
     * print. Attribute-context prints are left untouched (handled later).
     *
     * @return string[]
     */
    private function wrapTextContentPrints(Node $root): void
    {
        $scanner = new WireHtmlScanner();
        $this->walkAndWrap($root, $scanner);
    }

    private function walkAndWrap(Node $parent, WireHtmlScanner $scanner): void
    {
        foreach ($parent as $key => $child) {
            if (!$child instanceof Node) {
                continue;
            }

            if ($child instanceof TextNode) {
                $scanner->consume($child->getAttribute('data'));
                continue;
            }

            if ($child instanceof PrintNode) {
                if (!$scanner->inAttribute()) {
                    $binding = WireBindingExtractor::extract($child->getNode('expr'));
                    if ($binding !== null) {
                        $parent->setNode($key, $this->wrapPrint($child, $binding));
                    }
                }
                continue;
            }

            $this->walkAndWrap($child, $scanner);
        }
    }

    private function wrapPrint(PrintNode $print, array $binding): Node
    {
        $json = json_encode($binding, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
        $line = $print->getTemplateLine();

        return new Nodes([
            new TextNode('<!--w:' . $json . '-->', $line),
            $print,
            new TextNode('<!--/w-->', $line),
        ]);
    }

    /**
     * Walk an expression tree and return every name+dot-chain found.
     * Recurses through filters, concat, and any other expression — paths are
     * collected for tracking even when the surrounding expression is not
     * reactive (frozen at render time).
     *
     * @return string[]
     */
    private function collectPaths(Node $node): array
    {
        $path = WireBindingExtractor::extractPath($node);
        if ($path !== null) {
            return [$path];
        }

        $paths = [];
        foreach ($node as $child) {
            if ($child instanceof Node) {
                foreach ($this->collectPaths($child) as $p) {
                    $paths[] = $p;
                }
            }
        }

        return $paths;
    }

    public function getPriority(): int
    {
        return 0;
    }
}
