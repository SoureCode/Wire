<?php

namespace SoureCode\Wire;

use Twig\Compiler;
use Twig\Node\Node;

class WireScopeStartNode extends Node
{
    /**
     * @param string[] $paths
     * @param string[] $groups
     */
    public function __construct(string $templateName, array $paths, array $groups, int $lineno)
    {
        parent::__construct([], [
            'template' => $templateName,
            'paths'    => $paths,
            'groups'   => $groups,
            'var'      => '__wire_' . md5($templateName) . '__',
        ], $lineno);
    }

    public function compile(Compiler $compiler): void
    {
        $templateName = $this->getAttribute('template');
        $paths        = $this->getAttribute('paths');
        $groups       = $this->getAttribute('groups');
        $var          = $this->getAttribute('var');

        $scopeId = WireHelper::scopeId($templateName, $compiler->getEnvironment()->isDebug());

        $compiler
            ->write("\${$var} = \$this->env->getRuntime(\\SoureCode\\Wire\\WireRuntime::class)")
            ->raw('->renderScope($context, ' . var_export($paths, true) . ', ' . var_export($scopeId, true) . ', ' . var_export($groups, true) . ");\n")
            ->write("echo \${$var};\n");
    }
}
