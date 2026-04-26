<?php

namespace SoureCode\Bundle\Wire\DependencyInjection;

use Doctrine\Persistence\ManagerRegistry;
use SoureCode\Wire\Serializer\WireIdentityNormalizer;
use SoureCode\Wire\WireExtension as TwigWireExtension;
use SoureCode\Wire\WireRuntime;
use Symfony\Component\DependencyInjection\ContainerBuilder;
use Symfony\Component\DependencyInjection\Extension\Extension;
use Symfony\Component\DependencyInjection\Reference;
use Symfony\Component\Routing\RouterInterface;
use Symfony\Component\Serializer\Normalizer\NormalizerInterface;

class WireExtension extends Extension
{
    public function load(array $configs, ContainerBuilder $container): void
    {
        $container->register(TwigWireExtension::class)
            ->addTag('twig.extension')
            ->setPublic(false);

        $container->register(WireIdentityNormalizer::class)
            ->setArguments([
                new Reference(ManagerRegistry::class),
                new Reference(RouterInterface::class),
                '%kernel.debug%',
            ])
            ->addTag('serializer.normalizer', ['priority' => 100])
            ->setPublic(false);

        $container->register(WireRuntime::class)
            ->setArguments([
                new Reference(NormalizerInterface::class),
                'wire',
            ])
            ->addTag('twig.runtime')
            ->addTag('kernel.reset', ['method' => 'reset'])
            ->setPublic(false);
    }
}
