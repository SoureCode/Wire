<?php

namespace SoureCode\Wire;

use Twig\Compiler;
use Twig\Node\Node;

class WireScopeEndNode extends Node
{
    public function __construct(string $templateName, int $lineno)
    {
        parent::__construct([], [
            'template' => $templateName,
            'var'      => '__wire_' . md5($templateName) . '__',
        ], $lineno);
    }

    public function compile(Compiler $compiler): void
    {
        $templateName = $this->getAttribute('template');
        $var          = $this->getAttribute('var');

        $scopeId = WireHelper::scopeId($templateName, $compiler->getEnvironment()->isDebug());

        $compiler
            ->write("if (\${$var} !== '') {\n")
            ->write("    echo '<!-- /wire-scope:" . addslashes($scopeId) . " -->';\n")
            ->write("}\n");
    }
}
