<?php

namespace SoureCode\Wire\Tests;

use Doctrine\Persistence\ManagerRegistry;
use PHPUnit\Framework\TestCase;
use SoureCode\Wire\WireIdentityResolver;
use SoureCode\Wire\WireRuntime;
use Symfony\Component\PropertyAccess\PropertyAccess;
use Symfony\Component\Routing\RouterInterface;
use Symfony\Component\Serializer\Normalizer\ObjectNormalizer;
use Symfony\Component\Serializer\Serializer;

class WireRuntimeTest extends TestCase
{
    private function runtime(): WireRuntime
    {
        $resolver = new WireIdentityResolver(
            $this->createStub(ManagerRegistry::class),
            $this->createStub(RouterInterface::class),
            PropertyAccess::createPropertyAccessor(),
            true,
        );
        return new WireRuntime($resolver, new Serializer([new ObjectNormalizer()]));
    }

    private function decode(string $html): array
    {
        preg_match('/<script type="wire">(.*?)<\/script>/s', $html, $m);
        $this->assertNotEmpty($m, 'No wire script tag found');
        return json_decode($m[1], true);
    }

    public function testRendersEmptyStringWhenNoPathsMatchContext(): void
    {
        $html = $this->runtime()->renderScope([], ['user.name'], 'scope');
        $this->assertSame('', $html);
    }

    public function testRendersEmptyStringWhenRootIsNull(): void
    {
        $html = $this->runtime()->renderScope(['user' => null], ['user.name'], 'scope');
        $this->assertSame('', $html);
    }

    public function testRendersScopeMarkersAndJsonForScalarPath(): void
    {
        $html = $this->runtime()->renderScope(['name' => 'Jason'], ['name'], 'scope');
        $this->assertStringContainsString('<!-- wire-scope:scope -->', $html);
        $this->assertStringContainsString('<script type="wire">{"name":"Jason"}</script>', $html);
    }

    public function testNestedPathsWalkObjectFields(): void
    {
        $user = (object)['name' => 'Jason', 'email' => 'j@example.com'];
        $data = $this->decode($this->runtime()->renderScope(
            ['user' => $user],
            ['user.name', 'user.email'],
            'scope',
        ));
        $this->assertSame('Jason', $data['user']['name']);
        $this->assertSame('j@example.com', $data['user']['email']);
    }

    public function testArrayPathsRecurse(): void
    {
        $data = $this->decode($this->runtime()->renderScope(
            ['cart' => ['total' => 99.99, 'sku' => 'A']],
            ['cart.total', 'cart.sku'],
            'scope',
        ));
        $this->assertSame(99.99, $data['cart']['total']);
        $this->assertSame('A', $data['cart']['sku']);
    }

    public function testIntraScopeRefDedupBySplObjectId(): void
    {
        $shared = (object)['name' => 'Shared'];
        $data = $this->decode($this->runtime()->renderScope(
            ['a' => $shared, 'b' => $shared],
            ['a.name', 'b.name'],
            'scope',
        ));
        $this->assertSame('Shared', $data['a']['name']);
        $this->assertSame(['$ref' => 'a'], $data['b']);
    }

    public function testCrossScopeRefDedupAcrossRenderCalls(): void
    {
        $runtime = $this->runtime();
        $shared  = (object)['name' => 'Shared'];

        $runtime->renderScope(['user' => $shared], ['user.name'], 'scope1');
        $data = $this->decode($runtime->renderScope(['owner' => $shared], ['owner.name'], 'scope2'));

        $this->assertSame(['$ref' => 'scope1#user'], $data['owner']);
    }

    public function testResetClearsCrossScopeState(): void
    {
        $runtime = $this->runtime();
        $shared  = (object)['name' => 'Shared'];

        $runtime->renderScope(['user' => $shared], ['user.name'], 'scope1');
        $runtime->reset();
        $data = $this->decode($runtime->renderScope(['owner' => $shared], ['owner.name'], 'scope2'));

        $this->assertSame('Shared', $data['owner']['name']);
        $this->assertArrayNotHasKey('$ref', $data['owner']);
    }

    public function testNestedArrayPathDedupsByObjectIdentity(): void
    {
        $shared = (object)['name' => 'Jason'];
        $data = $this->decode($this->runtime()->renderScope(
            ['user' => $shared, 'cart' => ['owner' => $shared]],
            ['user.name', 'cart.owner.name'],
            'scope',
        ));
        $this->assertSame('Jason', $data['user']['name']);
        $this->assertSame(['$ref' => 'user'], $data['cart']['owner']);
    }

    public function testMissingPathIsSkipped(): void
    {
        $data = $this->decode($this->runtime()->renderScope(
            ['user' => (object)['name' => 'Jason']],
            ['user.name', 'absent.field'],
            'scope',
        ));
        $this->assertArrayHasKey('user', $data);
        $this->assertArrayNotHasKey('absent', $data);
    }
}
