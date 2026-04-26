<?php

namespace SoureCode\Wire;

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
        $templateName = $this->getAttribute('template');
        $var          = $this->getAttribute('var');

        $scopeId = WireHelper::scopeId($templateName, $compiler->getEnvironment()->isDebug());
        $marker  = addslashes($scopeId);

        $compiler
            ->write("if (!empty(\${$var})) {\n")
            ->write("    echo '<!-- /wire-scope:" . $marker . " -->';\n")
            ->write("}\n");
    }
}
