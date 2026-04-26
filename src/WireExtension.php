<?php

namespace Wire;

use Twig\Extension\AbstractExtension;

class WireExtension extends AbstractExtension
{
    public function getNodeVisitors(): array
    {
        return [new WireNodeVisitor()];
    }

    public function getTokenParsers(): array
    {
        return [new WireTokenParser()];
    }
}
