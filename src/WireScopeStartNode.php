<?php

namespace SoureCode\Wire;

use Twig\Compiler;
use Twig\Node\Node;

class WireScopeStartNode extends Node
{
    public function __construct(string $templateName, array $paths, int $lineno)
    {
        parent::__construct([], ['template' => $templateName, 'paths' => $paths, 'var' => '__wire_' . md5($templateName) . '__'], $lineno);
    }

    public function compile(Compiler $compiler): void
    {
        $templateName = $this->getAttribute('template');
        $paths        = $this->getAttribute('paths');
        $var          = $this->getAttribute('var');

        $scopeId = WireHelper::scopeId($templateName, $compiler->getEnvironment()->isDebug());
        $marker  = addslashes($scopeId);

        $compiler
            ->write("\${$var} = \\SoureCode\\Wire\\WireHelper::extract(\$context, " . var_export($paths, true) . ", " . var_export($scopeId, true) . ");\n")
            ->write("if (!empty(\${$var})) {\n")
            ->write("    echo '<!-- wire-scope:" . $marker . " -->';\n")
            ->write("    echo '<script type=\"wire\">' . json_encode(\${$var}) . '</script>';\n")
            ->write("}\n");
    }
}
