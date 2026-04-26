<?php

namespace App\Tests\Integration;

use App\Entity\User;
use SoureCode\Wire\WireHelper;

class WireBasicTest extends WireIntegrationTestCase
{
    public function testScopeMarkersPresent(): void
    {
        $user = new User('Jason', 'jason@example.com');
        $this->em->persist($user);
        $this->em->flush();

        WireHelper::reset();
        $html = $this->twig->render('wire_test/user.html.twig', ['user' => $user]);

        $this->assertStringContainsString('<!-- wire-scope:wire_test/user.html.twig -->', $html);
        $this->assertStringContainsString('<!-- /wire-scope:wire_test/user.html.twig -->', $html);
    }

    public function testJsonBootstrapContainsEntityData(): void
    {
        $user = new User('Jason', 'jason@example.com', 'active');
        $this->em->persist($user);
        $this->em->flush();

        $data = $this->wireData('wire_test/user.html.twig', ['user' => $user]);
        $this->assertSame('Jason', $data['user']['name']);
        $this->assertSame('jason@example.com', $data['user']['email']);
        $this->assertSame('active', $data['user']['status']);
    }

    public function testSameEntityInTwoScopesProducesRef(): void
    {
        $user = new User('Shared', 'shared@example.com');
        $this->em->persist($user);
        $this->em->flush();

        WireHelper::reset();
        WireHelper::extract(['user' => $user], ['user.name', 'user.email'], 'scope1');
        $result = WireHelper::extract(['owner' => $user], ['owner.name'], 'scope2');

        $this->assertArrayHasKey('$ref', $result['owner']);
        $this->assertStringStartsWith('scope1#', $result['owner']['$ref']);
    }

    public function testDebugScopeIdEqualsTemplateName(): void
    {
        $name = 'wire_test/user.html.twig';
        $this->assertSame($name, WireHelper::scopeId($name, true));
    }

    public function testProdScopeIdIsEightCharHex(): void
    {
        $id = WireHelper::scopeId('wire_test/user.html.twig', false);
        $this->assertMatchesRegularExpression('/^[0-9a-f]{8}$/', $id);
    }

    public function testProdScopeIdMatchesSha256Prefix(): void
    {
        $name = 'wire_test/user.html.twig';
        $expected = substr(hash('sha256', $name), 0, 8);
        $this->assertSame($expected, WireHelper::scopeId($name, false));
    }

    public function testDebugScopeMarkersContainTemplateName(): void
    {
        $user = new User('Jason', 'jason@example.com', 'active');
        $this->em->persist($user);
        $this->em->flush();

        WireHelper::reset();
        $html = $this->twig->render('wire_test/user.html.twig', ['user' => $user]);

        $this->assertStringContainsString('<!-- wire-scope:wire_test/user.html.twig -->', $html);
        $this->assertStringNotContainsString(
            '<!-- wire-scope:' . substr(hash('sha256', 'wire_test/user.html.twig'), 0, 8) . ' -->',
            $html
        );
    }

    public function testProdScopeMarkersWouldUseHashNotTemplateName(): void
    {
        $name = 'wire_test/user.html.twig';
        $hash = WireHelper::scopeId($name, false);

        $this->assertMatchesRegularExpression('/^[0-9a-f]{8}$/', $hash);
        $this->assertNotSame($name, $hash);
        $this->assertSame(substr(hash('sha256', $name), 0, 8), $hash);
    }
}
