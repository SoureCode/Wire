<?php

namespace SoureCode\Wire;

use Twig\Environment;
use Twig\Node\EmbedNode;
use Twig\Node\Expression\ConstantExpression;
use Twig\Node\Expression\GetAttrExpression;
use Twig\Node\Expression\NameExpression;
use Twig\Node\IncludeNode;
use Twig\Node\ModuleNode;
use Twig\Node\Node;
use Twig\Node\Nodes;
use Twig\Node\PrintNode;
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
     * Walk an expression tree and return every name+dot-chain found.
     * Recurses through filters, concat, and any other expression — paths are
     * collected for tracking even when the surrounding expression is not
     * reactive (frozen at render time).
     *
     * @return string[]
     */
    private function collectPaths(Node $node): array
    {
        $path = $this->extractPath($node);
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

    /**
     * If the node is a pure name + dot-chain (NameExpression at the root,
     * GetAttrExpression with constant string keys above it), return the
     * dot-path. Otherwise null.
     */
    private function extractPath(Node $node): ?string
    {
        if ($node instanceof NameExpression) {
            return $node->getAttribute('name');
        }

        if ($node instanceof GetAttrExpression) {
            $inner = $this->extractPath($node->getNode('node'));
            if ($inner === null) {
                return null;
            }

            $attribute = $node->getNode('attribute');
            if (!$attribute instanceof ConstantExpression) {
                return null;
            }

            $key = $attribute->getAttribute('value');
            if (!is_string($key)) {
                return null;
            }

            return $inner . '.' . $key;
        }

        return null;
    }

    public function getPriority(): int
    {
        return 0;
    }
}
