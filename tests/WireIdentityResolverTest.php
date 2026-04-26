<?php

namespace SoureCode\Wire\Tests;

use Doctrine\Persistence\Mapping\ClassMetadata;
use Doctrine\Persistence\ObjectManager;
use Doctrine\Persistence\ManagerRegistry;
use PHPUnit\Framework\TestCase;
use SoureCode\Wire\Tests\Fixtures\WireResolverFixtureUser;
use SoureCode\Wire\WireIdentityResolver;
use Symfony\Component\PropertyAccess\PropertyAccess;
use Symfony\Component\Routing\Generator\UrlGenerator;
use Symfony\Component\Routing\RequestContext;
use Symfony\Component\Routing\Route;
use Symfony\Component\Routing\RouteCollection;
use Symfony\Component\Routing\RouterInterface;

class WireIdentityResolverTest extends TestCase
{
    private function buildRouter(RouteCollection $routes): RouterInterface
    {
        $generator = new UrlGenerator($routes, new RequestContext());

        return new class($routes, $generator) implements RouterInterface {
            public function __construct(
                private readonly RouteCollection $routes,
                private readonly UrlGenerator $generator,
            ) {
            }
            public function setContext(RequestContext $context): void { $this->generator->setContext($context); }
            public function getContext(): RequestContext { return $this->generator->getContext(); }
            public function generate(string $name, array $parameters = [], int $referenceType = self::ABSOLUTE_PATH): string
            {
                return $this->generator->generate($name, $parameters, $referenceType);
            }
            public function match(string $pathinfo): array { throw new \BadMethodCallException(); }
            public function getRouteCollection(): RouteCollection { return $this->routes; }
        };
    }

    private function buildResolver(RouterInterface $router, string $entityClass): WireIdentityResolver
    {
        $metadata = $this->createMock(ClassMetadata::class);
        $metadata->method('getIdentifierValues')->willReturnCallback(
            fn (object $entity) => ['id' => $entity->id]
        );

        $manager = $this->createMock(ObjectManager::class);
        $manager->method('getClassMetadata')->willReturn($metadata);

        $registry = $this->createMock(ManagerRegistry::class);
        $registry->method('getManagerForClass')->willReturnCallback(
            fn (string $class) => $class === $entityClass ? $manager : null
        );

        return new WireIdentityResolver(
            $registry,
            $router,
            PropertyAccess::createPropertyAccessor(),
            true,
        );
    }

    public function testEmitsReadAndUpdateBlocksWithAutoResolvedParams(): void
    {
        $routes = new RouteCollection();
        $routes->add('fixture_user_read',   new Route('/api/users/{id}', [], [], [], '', [], ['GET']));
        $routes->add('fixture_user_update', new Route('/api/users/{id}', [], [], [], '', [], ['PATCH']));
        $router   = $this->buildRouter($routes);
        $resolver = $this->buildResolver($router, WireResolverFixtureUser::class);

        $tag = $resolver->tag(new WireResolverFixtureUser(42, 'Alice'));

        $this->assertNotNull($tag);
        $this->assertSame(WireResolverFixtureUser::class, $tag['__class']);
        $this->assertSame(42, $tag['__id']);

        $this->assertArrayHasKey('__read', $tag);
        $this->assertSame('/api/users/42', $tag['__read']['url']);
        $this->assertSame('GET', $tag['__read']['method']);

        $this->assertArrayHasKey('__update', $tag);
        $this->assertSame('/api/users/42', $tag['__update']['url']);
        $this->assertSame('PATCH', $tag['__update']['method']);
    }

    public function testThrowsOnUnknownRouteName(): void
    {
        $router   = $this->buildRouter(new RouteCollection());
        $resolver = $this->buildResolver($router, WireResolverFixtureUser::class);

        $this->expectException(\RuntimeException::class);
        $resolver->tag(new WireResolverFixtureUser(1, 'x'));
    }
}
