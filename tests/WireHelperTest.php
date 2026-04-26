<?php

namespace SoureCode\Wire\Tests;

use PHPUnit\Framework\TestCase;
use SoureCode\Wire\WireHelper;

class WireHelperTest extends TestCase
{
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
