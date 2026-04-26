<?php

namespace SoureCode\Wire\Tests;

use PHPUnit\Framework\TestCase;
use SoureCode\Wire\WireRuntime;
use Symfony\Component\Serializer\Normalizer\ObjectNormalizer;
use Symfony\Component\Serializer\Serializer;

class WireRuntimeTest extends TestCase
{
    private function runtime(): WireRuntime
    {
        return new WireRuntime(new Serializer([new ObjectNormalizer()]));
    }

    public function testRendersEmptyStringWhenNoRootsMatchContext(): void
    {
        $html = $this->runtime()->renderScope([], ['user'], 'scope');
        $this->assertSame('', $html);
    }

    public function testRendersEmptyStringWhenAllRootsAreNull(): void
    {
        $html = $this->runtime()->renderScope(['user' => null], ['user'], 'scope');
        $this->assertSame('', $html);
    }

    public function testRendersScopeMarkersAndJsonForScalarRoot(): void
    {
        $html = $this->runtime()->renderScope(['name' => 'Jason'], ['name'], 'scope');
        $this->assertStringContainsString('<!-- wire-scope:scope -->', $html);
        $this->assertStringContainsString('<script type="wire">{"name":"Jason"}</script>', $html);
    }

    public function testStdClassFallsBackToGetObjectVars(): void
    {
        $user = (object)['name' => 'Jason', 'email' => 'j@example.com'];
        $html = $this->runtime()->renderScope(['user' => $user], ['user'], 'scope');

        preg_match('/<script type="wire">(.*?)<\/script>/s', $html, $m);
        $data = json_decode($m[1], true);
        $this->assertSame('Jason', $data['user']['name']);
        $this->assertSame('j@example.com', $data['user']['email']);
    }

    public function testArraysPassThroughAndRecurse(): void
    {
        $html = $this->runtime()->renderScope(
            ['cart' => ['total' => 99.99, 'items' => [['sku' => 'A'], ['sku' => 'B']]]],
            ['cart'],
            'scope'
        );
        preg_match('/<script type="wire">(.*?)<\/script>/s', $html, $m);
        $data = json_decode($m[1], true);
        $this->assertSame(99.99, $data['cart']['total']);
        $this->assertSame('A', $data['cart']['items'][0]['sku']);
    }

    public function testIntraScopeRefDedupBySplObjectId(): void
    {
        $shared = (object)['name' => 'Shared'];
        $html = $this->runtime()->renderScope(
            ['a' => $shared, 'b' => $shared],
            ['a', 'b'],
            'scope'
        );
        preg_match('/<script type="wire">(.*?)<\/script>/s', $html, $m);
        $data = json_decode($m[1], true);
        $this->assertSame('Shared', $data['a']['name']);
        $this->assertSame(['$ref' => 'a'], $data['b']);
    }

    public function testCrossScopeRefDedupAcrossRenderCalls(): void
    {
        $runtime = $this->runtime();
        $shared  = (object)['name' => 'Shared'];

        $runtime->renderScope(['user' => $shared], ['user'], 'scope1');
        $html = $runtime->renderScope(['owner' => $shared], ['owner'], 'scope2');

        preg_match('/<script type="wire">(.*?)<\/script>/s', $html, $m);
        $data = json_decode($m[1], true);
        $this->assertSame(['$ref' => 'scope1#user'], $data['owner']);
    }

    public function testResetClearsCrossScopeState(): void
    {
        $runtime = $this->runtime();
        $shared  = (object)['name' => 'Shared'];

        $runtime->renderScope(['user' => $shared], ['user'], 'scope1');
        $runtime->reset();
        $html = $runtime->renderScope(['owner' => $shared], ['owner'], 'scope2');

        preg_match('/<script type="wire">(.*?)<\/script>/s', $html, $m);
        $data = json_decode($m[1], true);
        $this->assertSame('Shared', $data['owner']['name']);
        $this->assertArrayNotHasKey('$ref', $data['owner']);
    }

    public function testRefRecursionThroughNestedArrays(): void
    {
        $shared = (object)['name' => 'Jason'];
        $html = $this->runtime()->renderScope(
            ['user' => $shared, 'cart' => ['owner' => $shared]],
            ['user', 'cart'],
            'scope'
        );
        preg_match('/<script type="wire">(.*?)<\/script>/s', $html, $m);
        $data = json_decode($m[1], true);
        $this->assertSame(['$ref' => 'user'], $data['cart']['owner']);
    }

    public function testMissingRootIsSkipped(): void
    {
        $html = $this->runtime()->renderScope(
            ['user' => (object)['name' => 'Jason']],
            ['user', 'absent'],
            'scope'
        );
        preg_match('/<script type="wire">(.*?)<\/script>/s', $html, $m);
        $data = json_decode($m[1], true);
        $this->assertArrayHasKey('user', $data);
        $this->assertArrayNotHasKey('absent', $data);
    }
}
