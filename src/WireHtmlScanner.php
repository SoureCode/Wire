<?php

namespace SoureCode\Wire;

/**
 * Tiny stateful HTML cursor that tracks whether subsequent characters are
 * inside an attribute value (for distinguishing between text-content and
 * attribute-context Twig prints). Not a full HTML parser — handles the cases
 * we encounter in practice: tags with double- or single-quoted attribute
 * values, possibly with `>` / `<` inside attribute strings.
 */
class WireHtmlScanner
{
    private const TEXT = 0;
    private const TAG = 1;
    private const ATTR_DOUBLE = 2;
    private const ATTR_SINGLE = 3;

    private int $state = self::TEXT;

    public function inAttribute(): bool
    {
        return $this->state === self::ATTR_DOUBLE || $this->state === self::ATTR_SINGLE;
    }

    public function consume(string $text): void
    {
        $len = strlen($text);
        for ($i = 0; $i < $len; $i++) {
            $c = $text[$i];

            switch ($this->state) {
                case self::TEXT:
                    if ($c === '<') {
                        $this->state = self::TAG;
                    }
                    break;

                case self::TAG:
                    if ($c === '>') {
                        $this->state = self::TEXT;
                    } elseif ($c === '"') {
                        $this->state = self::ATTR_DOUBLE;
                    } elseif ($c === "'") {
                        $this->state = self::ATTR_SINGLE;
                    }
                    break;

                case self::ATTR_DOUBLE:
                    if ($c === '"') {
                        $this->state = self::TAG;
                    }
                    break;

                case self::ATTR_SINGLE:
                    if ($c === "'") {
                        $this->state = self::TAG;
                    }
                    break;
            }
        }
    }
}
