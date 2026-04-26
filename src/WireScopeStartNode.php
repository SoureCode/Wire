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
        $template = addslashes($this->getAttribute('template'));
        $paths = $this->getAttribute('paths');
        $var = $this->getAttribute('var');

        $compiler
            ->write("\${$var} = \\SoureCode\\Wire\\WireHelper::extract(\$context, " . var_export($paths, true) . ", " . var_export($this->getAttribute('template'), true) . ");\n")
            ->write("if (!empty(\${$var})) {\n")
            ->write("    echo '<!-- wire-scope:" . $template . " -->';\n")
            ->write("    echo '<script type=\"wire\">' . json_encode(\${$var}) . '</script>';\n")
            ->write("}\n");
    }
}
