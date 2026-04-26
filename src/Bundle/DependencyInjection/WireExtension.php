<?php

namespace SoureCode\Bundle\Wire\DependencyInjection;

use SoureCode\Wire\WireExtension as TwigWireExtension;
use Symfony\Component\DependencyInjection\ContainerBuilder;
use Symfony\Component\DependencyInjection\Extension\Extension;

class WireExtension extends Extension
{
    public function load(array $configs, ContainerBuilder $container): void
    {
        $container->register(TwigWireExtension::class)
            ->addTag('twig.extension')
            ->setPublic(false);
    }
}
