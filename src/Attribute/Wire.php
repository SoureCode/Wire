<?php

namespace SoureCode\Wire\Attribute;

#[\Attribute(\Attribute::TARGET_CLASS)]
final class Wire
{
    /**
     * @param array<string,mixed> $readRouteParams
     * @param array<string,mixed> $updateRouteParams
     */
    public function __construct(
        public readonly ?string $submit = null,
        public readonly ?string $readRouteName = null,
        public readonly ?string $updateRouteName = null,
        public readonly array $readRouteParams = [],
        public readonly array $updateRouteParams = [],
    ) {
    }
}
