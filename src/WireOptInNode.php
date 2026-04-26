<?php

namespace SoureCode\Wire;

use Twig\Compiler;
use Twig\Node\Node;

class WireOptInNode extends Node
{
    /**
     * @param string[] $groups
     */
    public function __construct(int $lineno, bool $cascade = false, array $groups = [])
    {
        parent::__construct([], [
            'cascade' => $cascade,
            'groups'  => $groups,
        ], $lineno);
    }

    public function compile(Compiler $compiler): void
    {
    }
}
