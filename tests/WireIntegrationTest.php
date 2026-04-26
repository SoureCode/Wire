<?php

namespace SoureCode\Wire\Tests;

use PHPUnit\Framework\TestCase;
use Twig\Environment;
use Twig\Loader\FilesystemLoader;
use SoureCode\Wire\WireExtension;
use SoureCode\Wire\WireHelper;

class WireIntegrationTest extends TestCase
{
    private Environment $twig;

    protected function setUp(): void
    {
        $loader = new FilesystemLoader(__DIR__ . '/fixtures/templates');
        $this->twig = new Environment($loader);
        $this->twig->addExtension(new WireExtension());
        WireHelper::reset();
    }

    public function testScopeMarkersPresent(): void
    {
        $user = (object)['name' => 'Jason', 'email' => 'jason@test.com'];
        $html = $this->twig->render('simple.html.twig', ['user' => $user]);

        $this->assertStringContainsString('<!-- wire-scope:simple.html.twig -->', $html);
        $this->assertStringContainsString('<!-- /wire-scope:simple.html.twig -->', $html);
    }

    public function testJsonBootstrapContainsData(): void
    {
        $user = new \stdClass();
        $user->name = 'Jason';
        $user->email = 'jason@test.com';
        $html = $this->twig->render('simple.html.twig', ['user' => $user]);

        preg_match('/<script type="wire">(.*?)<\/script>/s', $html, $m);
        $this->assertNotEmpty($m, 'No wire script tag found');
        $data = json_decode($m[1], true);
        $this->assertSame('Jason', $data['user']['name']);
        $this->assertSame('jason@test.com', $data['user']['email']);
    }

    public function testNoScopeWithoutWireTag(): void
    {
        $html = $this->twig->render('no_wire.html.twig', ['name' => 'test']);

        $this->assertStringNotContainsString('wire-scope', $html);
        $this->assertStringNotContainsString('<script type="wire">', $html);
    }

    public function testCascadeChildGetsScope(): void
    {
        $address = new \stdClass();
        $address->city = 'Berlin';
        $address->street = 'Main St';
        $html = $this->twig->render('cascade_parent.html.twig', ['address' => $address]);

        $this->assertStringContainsString('<!-- wire-scope:cascade_child.html.twig -->', $html);
    }

    public function testCascadeParentAlsoGetsScope(): void
    {
        $address = new \stdClass();
        $address->city = 'Berlin';
        $address->street = 'Main St';
        $html = $this->twig->render('cascade_parent.html.twig', ['address' => $address]);

        $this->assertStringContainsString('<!-- wire-scope:cascade_parent.html.twig -->', $html);
    }

    public function testCrossTemplateLocalRefResolution(): void
    {
        $person = new \stdClass();
        $person->name = 'Jason';
        $cart = ['owner' => $person, 'total' => 99.99];
        $html = $this->twig->render('cross_ref.html.twig', ['user' => $person, 'cart' => $cart]);

        preg_match('/<script type="wire">(.*?)<\/script>/s', $html, $m);
        $this->assertNotEmpty($m, 'No wire script tag found');
        $data = json_decode($m[1], true);

        // cart.owner is the same PHP object as user — must be serialised as a $ref
        $this->assertArrayHasKey('$ref', $data['cart']['owner']);
        $this->assertSame('user', $data['cart']['owner']['$ref']);
    }

    public function testWireCascadeTagDoesNotProduceOutput(): void
    {
        $address = new \stdClass();
        $address->city = 'Berlin';
        $address->street = 'Main St';
        $html = $this->twig->render('cascade_parent.html.twig', ['address' => $address]);

        // The {% wire cascade %} tag itself must not emit any characters
        $this->assertStringNotContainsString('wire cascade', $html);
    }
}
