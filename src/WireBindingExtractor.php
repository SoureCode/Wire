<?php

namespace SoureCode\Wire;

use Twig\Node\Expression\ArrayExpression;
use Twig\Node\Expression\Binary\ConcatBinary;
use Twig\Node\Expression\ConstantExpression;
use Twig\Node\Expression\FilterExpression;
use Twig\Node\Expression\GetAttrExpression;
use Twig\Node\Expression\NameExpression;
use Twig\Node\Node;

/**
 * Compile-time inspection of a Twig print expression. Produces either:
 *
 *   - ['p' => 'user.name']                                  pure path
 *   - ['p' => 'user.name', 'f' => [['upper'], ['default','x']]]  path + filter chain
 *   - ['parts' => [['l' => 'foo'], ['p' => 'user.name']]]   concat of literals + paths
 *   - null                                                  not auto-detectable (frozen)
 */
class WireBindingExtractor
{
    /** Filters supported by the JS-side replay registry. */
    public const FILTERS = [
        'upper', 'lower', 'trim', 'capitalize', 'length', 'abs',
        'default', 'nl2br', 'escape', 'e', 'raw',
    ];

    public static function extract(Node $expr): ?array
    {
        $path = self::extractPath($expr);
        if ($path !== null) {
            return ['p' => $path];
        }

        if ($expr instanceof FilterExpression) {
            return self::extractFilter($expr);
        }

        if ($expr instanceof ConcatBinary) {
            $parts = self::flattenConcat($expr);
            if ($parts === null) {
                return null;
            }
            return ['parts' => $parts];
        }

        return null;
    }

    /**
     * Pure NameExpression / GetAttrExpression chain → dot-path.
     */
    public static function extractPath(Node $node): ?string
    {
        if ($node instanceof NameExpression) {
            return $node->getAttribute('name');
        }

        if ($node instanceof GetAttrExpression) {
            $inner = self::extractPath($node->getNode('node'));
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

    private static function extractFilter(FilterExpression $node): ?array
    {
        $inner = self::extract($node->getNode('node'));
        if ($inner === null) {
            return null;
        }

        $filterNode = $node->getNode('filter');
        if (!$filterNode instanceof ConstantExpression) {
            return null;
        }

        $name = $filterNode->getAttribute('value');
        if (!is_string($name) || !in_array($name, self::FILTERS, true)) {
            return null;
        }

        // Twig's auto-escape (`escape` filter with html strategy) is wrapped
        // around every print by the Escaper visitor. Client-side text bindings
        // already write through textContent (auto-escaped) and attribute
        // writes through setAttribute, so replaying it is redundant — drop
        // the entry from the chain.
        if ($name === 'escape' || $name === 'e') {
            return $inner;
        }

        $args = self::extractFilterArgs($node->getNode('arguments'));
        if ($args === null) {
            return null;
        }

        $entry = [$name, ...$args];
        $inner['f'] = array_merge($inner['f'] ?? [], [$entry]);

        return $inner;
    }

    /**
     * Extract a filter's positional argument list, or null if any argument
     * is not a literal constant. Twig stores filter arguments as either an
     * ArrayExpression (alternating key/value child pairs) or as a plain Node
     * container of value expressions.
     */
    private static function extractFilterArgs(Node $arguments): ?array
    {
        $args = [];

        if ($arguments instanceof ArrayExpression) {
            foreach ($arguments as $key => $child) {
                if ($key % 2 === 0) {
                    continue;
                }
                if (!$child instanceof ConstantExpression) {
                    return null;
                }
                $args[] = $child->getAttribute('value');
            }
            return $args;
        }

        foreach ($arguments as $child) {
            if (!$child instanceof Node) {
                continue;
            }
            if (!$child instanceof ConstantExpression) {
                return null;
            }
            $args[] = $child->getAttribute('value');
        }

        return $args;
    }

    /**
     * Flatten a concat tree into a list of {l: literal} / {p: path, f: ...} parts.
     * Any segment that isn't a literal or a recognised binding makes the whole
     * concat un-emittable.
     */
    private static function flattenConcat(Node $node): ?array
    {
        if ($node instanceof ConcatBinary) {
            $left = self::flattenConcat($node->getNode('left'));
            $right = self::flattenConcat($node->getNode('right'));

            if ($left === null || $right === null) {
                return null;
            }

            return [...$left, ...$right];
        }

        if ($node instanceof ConstantExpression) {
            return [['l' => (string) $node->getAttribute('value')]];
        }

        $binding = self::extract($node);
        if ($binding === null) {
            return null;
        }

        if (isset($binding['parts'])) {
            return $binding['parts'];
        }

        return [$binding];
    }
}
