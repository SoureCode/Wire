<?php

namespace SoureCode\Wire\Tests;

use PHPUnit\Framework\TestCase;
use SoureCode\Wire\WireExtension;
use SoureCode\Wire\WireHelper;
use SoureCode\Wire\WireRuntime;
use Symfony\Component\Serializer\Normalizer\ObjectNormalizer;
use Symfony\Component\Serializer\Serializer;
use Twig\Environment;
use Twig\Loader\FilesystemLoader;
use Twig\RuntimeLoader\FactoryRuntimeLoader;

class WireIntegrationTest extends TestCase
{
    protected function setUp(): void
    {
        WireHelper::reset();
    }

    private function createEnv(bool $debug = true): Environment
    {
        $loader = new FilesystemLoader(__DIR__ . '/fixtures/templates');
        $twig   = new Environment($loader, ['debug' => $debug]);
        $twig->addExtension(new WireExtension());

        $runtime = new WireRuntime(new Serializer([new ObjectNormalizer()]));

        $twig->addRuntimeLoader(new FactoryRuntimeLoader([
            WireRuntime::class => fn () => $runtime,
        ]));

        return $twig;
    }

    public function testScopeMarkersPresent(): void
    {
        $user = (object)['name' => 'Jason', 'email' => 'jason@test.com'];
        $html = $this->createEnv()->render('simple.html.twig', ['user' => $user]);

        $this->assertStringContainsString('<!-- wire-scope:simple.html.twig -->', $html);
        $this->assertStringContainsString('<!-- /wire-scope:simple.html.twig -->', $html);
    }

    public function testJsonBootstrapContainsData(): void
    {
        $user = (object)['name' => 'Jason', 'email' => 'jason@test.com'];
        $html = $this->createEnv()->render('simple.html.twig', ['user' => $user]);

        preg_match('/<script type="wire">(.*?)<\/script>/s', $html, $m);
        $this->assertNotEmpty($m, 'No wire script tag found');
        $data = json_decode($m[1], true);
        $this->assertSame('Jason', $data['user']['name']);
        $this->assertSame('jason@test.com', $data['user']['email']);
    }

    public function testNoIdentityTagsForPlainObjects(): void
    {
        $user = (object)['name' => 'Jason'];
        $html = $this->createEnv()->render('simple.html.twig', ['user' => $user]);

        preg_match('/<script type="wire">(.*?)<\/script>/s', $html, $m);
        $data = json_decode($m[1], true);
        $this->assertArrayNotHasKey('__class', $data['user']);
        $this->assertArrayNotHasKey('__id', $data['user']);
    }

    public function testNoScopeWithoutWireTag(): void
    {
        $html = $this->createEnv()->render('no_wire.html.twig', ['name' => 'test']);

        $this->assertStringNotContainsString('wire-scope', $html);
        $this->assertStringNotContainsString('<script type="wire">', $html);
    }

    public function testCascadeChildGetsScope(): void
    {
        $address = (object)['city' => 'Berlin', 'street' => 'Main St'];
        $html = $this->createEnv()->render('cascade_parent.html.twig', ['address' => $address]);

        $this->assertStringContainsString('<!-- wire-scope:cascade_child.html.twig -->', $html);
    }

    public function testCascadeParentAlsoGetsScope(): void
    {
        $address = (object)['city' => 'Berlin', 'street' => 'Main St'];
        $html = $this->createEnv()->render('cascade_parent.html.twig', ['address' => $address]);

        $this->assertStringContainsString('<!-- wire-scope:cascade_parent.html.twig -->', $html);
    }

    public function testCrossTemplateLocalRefResolution(): void
    {
        $person = (object)['name' => 'Jason'];
        $cart = ['owner' => $person, 'total' => 99.99];
        $html = $this->createEnv()->render('cross_ref.html.twig', ['user' => $person, 'cart' => $cart]);

        preg_match('/<script type="wire">(.*?)<\/script>/s', $html, $m);
        $this->assertNotEmpty($m, 'No wire script tag found');
        $data = json_decode($m[1], true);

        $this->assertArrayHasKey('$ref', $data['cart']['owner']);
        $this->assertSame('user', $data['cart']['owner']['$ref']);
    }

    public function testWireCascadeTagDoesNotProduceOutput(): void
    {
        $address = (object)['city' => 'Berlin', 'street' => 'Main St'];
        $html = $this->createEnv()->render('cascade_parent.html.twig', ['address' => $address]);

        $this->assertStringNotContainsString('wire cascade', $html);
    }

    public function testDebugModeUsesFullTemplatePathAsScope(): void
    {
        $user = (object)['name' => 'Jason'];
        $html = $this->createEnv(true)->render('simple.html.twig', ['user' => $user]);

        $this->assertStringContainsString('<!-- wire-scope:simple.html.twig -->', $html);
        $this->assertStringContainsString('<!-- /wire-scope:simple.html.twig -->', $html);
    }

    public function testProdModeUsesShortHashAsScope(): void
    {
        $user     = (object)['name' => 'Jason'];
        $html     = $this->createEnv(false)->render('simple.html.twig', ['user' => $user]);
        $expected = substr(hash('sha256', 'simple.html.twig'), 0, 8);

        $this->assertStringContainsString("<!-- wire-scope:{$expected} -->", $html);
        $this->assertStringContainsString("<!-- /wire-scope:{$expected} -->", $html);
        $this->assertStringNotContainsString('wire-scope:simple.html.twig', $html);
    }
}
