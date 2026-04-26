<?php

namespace SoureCode\Wire;

use Twig\Node\Node;
use Twig\Node\PrintNode;
use Twig\Node\TextNode;

/**
 * AST pass that processes attribute-context Twig prints. For each tag
 * attribute whose value contains one or more {{ ... }} expressions:
 *
 *   - Collects the parts (literals + path/filter/concat bindings)
 *   - Injects a sibling `wire:<attr>='<json>'` attribute on the same tag
 *
 * The original PrintNode is left in place so the attribute still renders
 * its initial value at server side. The injected marker tells the JS
 * client how to rebuild the attribute when any path changes.
 *
 * Attribute groups containing a frozen (unsupported) expression are
 * silently dropped — no marker is emitted, the original print still
 * renders. Path tracking for those expressions happens in WireNodeVisitor.
 */
class WireAttrInjector
{
    private const TEXT = 0;
    private const TAG = 1;
    private const ATTR_DOUBLE = 2;
    private const ATTR_SINGLE = 3;

    private int $state = self::TEXT;

    /** @var array{attr:string,parts:list<array>,literal:string,ok:bool,hadPrint:bool}|null */
    private ?array $activeGroup = null;

    public function process(Node $container): void
    {
        foreach ($container as $key => $child) {
            if (!$child instanceof Node) {
                continue;
            }

            if ($child instanceof TextNode) {
                $newData = $this->processText($child->getAttribute('data'));
                if ($newData !== $child->getAttribute('data')) {
                    $child->setAttribute('data', $newData);
                }
                continue;
            }

            if ($child instanceof PrintNode) {
                $this->onPrint($child);
                continue;
            }

            $this->process($child);
        }
    }

    private function processText(string $text): string
    {
        $out = '';
        $i = 0;
        $len = strlen($text);

        while ($i < $len) {
            $c = $text[$i];

            // Skip HTML comments verbatim regardless of current state, so
            // wrapper markers added by step 2a don't confuse the scanner.
            if ($this->state === self::TEXT && substr($text, $i, 4) === '<!--') {
                $end = strpos($text, '-->', $i + 4);
                if ($end === false) {
                    $out .= substr($text, $i);
                    $i = $len;
                    continue;
                }
                $out .= substr($text, $i, $end - $i + 3);
                $i = $end + 3;
                continue;
            }

            switch ($this->state) {
                case self::TEXT:
                    if ($c === '<') {
                        $this->state = self::TAG;
                    }
                    $out .= $c;
                    $i++;
                    break;

                case self::TAG:
                    if ($c === '>') {
                        $this->state = self::TEXT;
                        $out .= $c;
                        $i++;
                        break;
                    }
                    if ($c === '"' || $c === "'") {
                        $attrName = $this->extractTrailingAttrName($out);
                        $this->state = $c === '"' ? self::ATTR_DOUBLE : self::ATTR_SINGLE;
                        $this->activeGroup = $attrName === null ? null : [
                            'attr'     => $attrName,
                            'parts'    => [],
                            'literal'  => '',
                            'ok'       => true,
                            'hadPrint' => false,
                        ];
                        $out .= $c;
                        $i++;
                        break;
                    }
                    $out .= $c;
                    $i++;
                    break;

                case self::ATTR_DOUBLE:
                case self::ATTR_SINGLE:
                    $closing = $this->state === self::ATTR_DOUBLE ? '"' : "'";
                    if ($c === $closing) {
                        if ($this->activeGroup !== null && $this->activeGroup['literal'] !== '') {
                            $this->activeGroup['parts'][] = ['l' => $this->activeGroup['literal']];
                            $this->activeGroup['literal'] = '';
                        }
                        $out .= $c;

                        if ($this->activeGroup !== null && $this->activeGroup['ok'] && $this->activeGroup['hadPrint']) {
                            $out .= ' ' . $this->buildMarker($this->activeGroup);
                        }

                        $this->activeGroup = null;
                        $this->state = self::TAG;
                        $i++;
                        break;
                    }
                    if ($this->activeGroup !== null) {
                        $this->activeGroup['literal'] .= $c;
                    }
                    $out .= $c;
                    $i++;
                    break;
            }
        }

        return $out;
    }

    private function onPrint(PrintNode $print): void
    {
        if ($this->state !== self::ATTR_DOUBLE && $this->state !== self::ATTR_SINGLE) {
            return;
        }
        if ($this->activeGroup === null) {
            return;
        }

        $this->activeGroup['hadPrint'] = true;

        if ($this->activeGroup['literal'] !== '') {
            $this->activeGroup['parts'][] = ['l' => $this->activeGroup['literal']];
            $this->activeGroup['literal'] = '';
        }

        $binding = WireBindingExtractor::extract($print->getNode('expr'));
        if ($binding === null) {
            $this->activeGroup['ok'] = false;
            return;
        }

        if (isset($binding['parts'])) {
            foreach ($binding['parts'] as $part) {
                $this->activeGroup['parts'][] = $part;
            }
        } else {
            $this->activeGroup['parts'][] = $binding;
        }
    }

    /**
     * Find the last `name=` token in the buffered tag text immediately
     * before the opening quote. Returns the attribute name or null when
     * no name can be identified.
     */
    private function extractTrailingAttrName(string $tagText): ?string
    {
        if (!preg_match('/([a-zA-Z_:][a-zA-Z0-9_:.-]*)\s*=\s*$/', $tagText, $m)) {
            return null;
        }
        return $m[1];
    }

    /**
     * @param array{attr:string,parts:list<array>} $group
     */
    private function buildMarker(array $group): string
    {
        $payload = count($group['parts']) === 1 && !isset($group['parts'][0]['l'])
            ? $group['parts'][0]
            : ['parts' => $group['parts']];

        $json = json_encode($payload, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
        // The marker is wrapped in single quotes so embedded `"` from JSON
        // are safe; literal `'` inside JSON are escaped via &#39; to avoid
        // breaking the attribute.
        $json = str_replace("'", '&#39;', $json);

        return 'wire:' . $group['attr'] . "='" . $json . "'";
    }
}
