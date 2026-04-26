<?php

namespace SoureCode\Wire;

use Twig\Environment;
use Twig\Node\EmbedNode;
use Twig\Node\Expression\ConstantExpression;
use Twig\Node\IncludeNode;
use Twig\Node\ModuleNode;
use Twig\Node\Node;
use Twig\Node\Nodes;
use Twig\Node\TextNode;
use Twig\NodeVisitor\NodeVisitorInterface;

class WireNodeVisitor implements NodeVisitorInterface
{
    private string $currentTemplate = '';
    private array $templateRoots = [];
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
            $this->templateRoots[$this->currentTemplate] = [];
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

        if ($node instanceof TextNode) {
            preg_match_all('/data-wire="([^"]+)"/', $node->getAttribute('data'), $matches);
            foreach ($matches[1] as $binding) {
                $path = explode(':', $binding)[0];
                $root = explode('.', $path)[0];
                $this->templateRoots[$this->currentTemplate][$root] = true;
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
            $roots = array_keys($this->templateRoots[$templateName] ?? []);
            $optedIn = !empty($this->templateOptIn[$templateName])
                || !empty($this->cascadeChildren[$templateName])
                || !empty(self::$globalCascadeChildren[$templateName]);

            if (!empty($roots) && $optedIn) {
                $node->setNode('display_start', new Nodes([
                    new WireScopeStartNode($templateName, $roots, $node->getTemplateLine()),
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

    public function getPriority(): int
    {
        return 0;
    }
}
