<?php

namespace SoureCode\Wire\Tests;

use PHPUnit\Framework\TestCase;
use SoureCode\Wire\WireHelper;

class WireHelperTest extends TestCase
{
    protected function setUp(): void
    {
        WireHelper::reset();
    }

    public function testExtractTopLevelScalar(): void
    {
        $result = WireHelper::extract(['name' => 'Jason'], ['name'], 'test');
        $this->assertSame(['name' => 'Jason'], $result);
    }

    public function testExtractNestedPath(): void
    {
        $user = new \stdClass();
        $user->name = 'Jason';
        $result = WireHelper::extract(['user' => $user], ['user.name'], 'test');
        $this->assertSame('Jason', $result['user']['name']);
    }

    public function testExtractMultiplePaths(): void
    {
        $user = new \stdClass();
        $user->name = 'Jason';
        $user->email = 'jason@example.com';
        $result = WireHelper::extract(['user' => $user], ['user.name', 'user.email'], 'test');
        $this->assertSame('Jason', $result['user']['name']);
        $this->assertSame('jason@example.com', $result['user']['email']);
    }

    public function testExtractMissingPathReturnsEmpty(): void
    {
        $result = WireHelper::extract([], ['missing.path'], 'test');
        $this->assertSame([], $result);
    }

    public function testExtractMissingNestedKeyReturnsEmpty(): void
    {
        $user = new \stdClass();
        $user->name = 'Jason';
        $result = WireHelper::extract(['user' => $user], ['user.missing'], 'test');
        $this->assertSame([], $result['user'] ?? []);
    }

    public function testLocalRefDeduplication(): void
    {
        $shared = new \stdClass();
        $shared->name = 'shared';
        $result = WireHelper::extract(
            ['a' => $shared, 'b' => $shared],
            ['a.name', 'b.name'],
            'test'
        );
        $this->assertArrayHasKey('$ref', $result['b']);
        $this->assertSame('a', $result['b']['$ref']);
    }

    public function testCrossScopeRefPointsToFirstScope(): void
    {
        $shared = new \stdClass();
        $shared->name = 'shared';

        WireHelper::extract(['a' => $shared], ['a.name'], 'scope1');
        $result2 = WireHelper::extract(['b' => $shared], ['b.name'], 'scope2');

        $this->assertArrayHasKey('$ref', $result2['b']);
        $this->assertSame('scope1#a', $result2['b']['$ref']);
    }

    public function testResetClearsCrossScopeState(): void
    {
        $shared = new \stdClass();
        $shared->name = 'shared';

        WireHelper::extract(['a' => $shared], ['a.name'], 'scope1');
        WireHelper::reset();
        $result2 = WireHelper::extract(['b' => $shared], ['b.name'], 'scope2');

        $this->assertSame('shared', $result2['b']['name']);
    }

    public function testExtractArrayContext(): void
    {
        $result = WireHelper::extract(['cart' => ['total' => 99.99]], ['cart.total'], 'test');
        $this->assertSame(99.99, $result['cart']['total']);
    }

    public function testExtractDeeplyNestedPath(): void
    {
        $address = new \stdClass();
        $address->city = 'Berlin';
        $user = new \stdClass();
        $user->address = $address;
        $result = WireHelper::extract(['user' => $user], ['user.address.city'], 'test');
        $this->assertSame('Berlin', $result['user']['address']['city']);
    }

    public function testScopeIdDebugReturnsTemplateName(): void
    {
        $this->assertSame(
            'wire_test/user.html.twig',
            WireHelper::scopeId('wire_test/user.html.twig', true)
        );
    }

    public function testScopeIdProdReturnsSha256Prefix(): void
    {
        $name = 'wire_test/user.html.twig';
        $expected = substr(hash('sha256', $name), 0, 8);
        $this->assertSame($expected, WireHelper::scopeId($name, false));
    }

    public function testScopeIdProdIsEightCharacters(): void
    {
        $this->assertSame(8, strlen(WireHelper::scopeId('any/template.html.twig', false)));
    }

    public function testScopeIdProdIsLowercaseHexadecimal(): void
    {
        $id = WireHelper::scopeId('any/template.html.twig', false);
        $this->assertMatchesRegularExpression('/^[0-9a-f]{8}$/', $id);
    }

    public function testScopeIdProdIsDeterministic(): void
    {
        $id1 = WireHelper::scopeId('template.html.twig', false);
        $id2 = WireHelper::scopeId('template.html.twig', false);
        $this->assertSame($id1, $id2);
    }

    public function testScopeIdDifferentTemplatesHaveDifferentIds(): void
    {
        $id1 = WireHelper::scopeId('template_a.html.twig', false);
        $id2 = WireHelper::scopeId('template_b.html.twig', false);
        $this->assertNotSame($id1, $id2);
    }

    public function testScopeIdProdContainsNoSlashes(): void
    {
        $id = WireHelper::scopeId('wire_test/user.html.twig', false);
        $this->assertStringNotContainsString('/', $id);
    }

    public function testScopeIdDebugAndProdAreDifferent(): void
    {
        $name = 'wire_test/user.html.twig';
        $this->assertNotSame(
            WireHelper::scopeId($name, true),
            WireHelper::scopeId($name, false)
        );
    }
}
