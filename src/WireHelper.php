<?php

namespace SoureCode\Wire;

class WireHelper
{
    public static function scopeId(string $templateName, bool $debug): string
    {
        return $debug ? $templateName : substr(hash('sha256', $templateName), 0, 8);
    }

    public static function reset(): void
    {
        WireNodeVisitor::resetCascade();
    }
}
