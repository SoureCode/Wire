<?php

namespace SoureCode\Wire\Attribute;

#[\Attribute(\Attribute::TARGET_CLASS)]
final class Wire
{
    public function __construct(
        public readonly ?string $submit = null,
    ) {
    }
}
