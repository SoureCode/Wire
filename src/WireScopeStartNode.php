<?php

namespace SoureCode\Wire;

use Twig\Compiler;
use Twig\Node\Node;

class WireScopeStartNode extends Node
{
    public function __construct(string $templateName, array $rootNames, int $lineno)
    {
        parent::__construct([], [
            'template' => $templateName,
            'roots'    => $rootNames,
            'var'      => '__wire_' . md5($templateName) . '__',
        ], $lineno);
    }

    public function compile(Compiler $compiler): void
    {
        $templateName = $this->getAttribute('template');
        $roots        = $this->getAttribute('roots');
        $var          = $this->getAttribute('var');

        $scopeId = WireHelper::scopeId($templateName, $compiler->getEnvironment()->isDebug());

        $compiler
            ->write("\${$var} = \$this->env->getRuntime(\\SoureCode\\Wire\\WireRuntime::class)")
            ->raw("->renderScope(\$context, " . var_export($roots, true) . ", " . var_export($scopeId, true) . ");\n")
            ->write("echo \${$var};\n");
    }
}
