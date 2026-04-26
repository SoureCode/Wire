<?php

namespace SoureCode\Wire;

use Twig\Compiler;
use Twig\Node\Node;

class WireOptInNode extends Node
{
    public function __construct(int $lineno, bool $cascade = false)
    {
        parent::__construct([], ['cascade' => $cascade], $lineno);
    }

    public function compile(Compiler $compiler): void
    {
    }
}
