<?php

namespace SoureCode\Bundle\Wire\DependencyInjection;

use Doctrine\Persistence\ManagerRegistry;
use SoureCode\Wire\WireExtension as TwigWireExtension;
use SoureCode\Wire\WireRuntime;
use Symfony\Component\DependencyInjection\ContainerBuilder;
use Symfony\Component\DependencyInjection\Extension\Extension;
use Symfony\Component\DependencyInjection\Reference;
use Symfony\Component\Routing\Generator\UrlGeneratorInterface;
use Symfony\Component\Serializer\SerializerInterface;

class WireExtension extends Extension
{
    public function load(array $configs, ContainerBuilder $container): void
    {
        $container->register(TwigWireExtension::class)
            ->addTag('twig.extension')
            ->setPublic(false);

        $container->register(WireRuntime::class)
            ->setArguments([
                new Reference(SerializerInterface::class),
                new Reference(ManagerRegistry::class),
                new Reference(UrlGeneratorInterface::class),
                '%kernel.debug%',
                'wire',
            ])
            ->addTag('twig.runtime')
            ->setPublic(false);
    }
}
