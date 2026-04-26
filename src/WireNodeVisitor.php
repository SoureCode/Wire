<?php

namespace SoureCode\Wire;

use Twig\Environment;
use Twig\Node\EmbedNode;
use Twig\Node\IncludeNode;
use Twig\Node\ModuleNode;
use Twig\Node\Node;
use Twig\Node\Nodes;
use Twig\Node\TextNode;
use Twig\Node\Expression\ConstantExpression;
use Twig\NodeVisitor\NodeVisitorInterface;

class WireNodeVisitor implements NodeVisitorInterface
{
    private string $currentTemplate = '';
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

        if ($node instanceof TextNode) {
            preg_match_all('/data-wire="([^"]+)"/', $node->getAttribute('data'), $matches);
            foreach ($matches[1] as $binding) {
                $path = explode(':', $binding)[0];
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

    private function hasOptIn(Node $node): bool
    {
        if ($node instanceof WireOptInNode) return true;
        foreach ($node as $child) {
            if ($this->hasOptIn($child)) return true;
        }
        return false;
    }

    private function extractPaths(Node $node): array
    {
        $paths = [];
        if ($node instanceof TextNode) {
            preg_match_all('/data-wire="([^"]+)"/', $node->getAttribute('data'), $matches);
            foreach ($matches[1] as $binding) {
                $path = explode(':', $binding)[0];
                $paths[$path] = true;
            }
        }
        foreach ($node as $child) {
            $paths = array_merge($paths, $this->extractPaths($child));
        }
        return $paths;
    }

    public function getPriority(): int
    {
        return 0;
    }
}
