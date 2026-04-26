<?php

namespace Wire;

use Twig\Compiler;
use Twig\Node\Node;

class WireScopeEndNode extends Node
{
    public function __construct(string $templateName, int $lineno)
    {
        $var = '__wire_' . md5($templateName) . '__';
        parent::__construct([], ['template' => $templateName, 'var' => $var], $lineno);
    }

    public function compile(Compiler $compiler): void
    {
        $template = addslashes($this->getAttribute('template'));
        $var = $this->getAttribute('var');

        $compiler
            ->write("if (!empty(\${$var})) {\n")
            ->write("    echo '<!-- /wire-scope:" . $template . " -->';\n")
            ->write("}\n");
    }
}
