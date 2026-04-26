<?php

namespace App\Tests\Integration;

use App\Entity\Address;
use App\Entity\Post;
use App\Entity\User;
use Doctrine\ORM\EntityManagerInterface;
use Doctrine\ORM\Tools\SchemaTool;
use SoureCode\Wire\WireHelper;
use Symfony\Bundle\FrameworkBundle\Test\KernelTestCase;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\RequestStack;
use Twig\Environment;

abstract class WireIntegrationTestCase extends KernelTestCase
{
    protected EntityManagerInterface $em;
    protected Environment $twig;

    protected function setUp(): void
    {
        self::bootKernel();
        $this->em   = static::getContainer()->get(EntityManagerInterface::class);
        $this->twig = static::getContainer()->get(Environment::class);

        static::getContainer()->get(RequestStack::class)->push(Request::create('/'));

        (new SchemaTool($this->em))->createSchema([
            $this->em->getClassMetadata(Address::class),
            $this->em->getClassMetadata(User::class),
            $this->em->getClassMetadata(Post::class),
        ]);

        WireHelper::reset();
    }

    protected function tearDown(): void
    {
        (new SchemaTool($this->em))->dropSchema([
            $this->em->getClassMetadata(Post::class),
            $this->em->getClassMetadata(User::class),
            $this->em->getClassMetadata(Address::class),
        ]);

        parent::tearDown();
    }

    protected function wireData(string $template, array $context): array
    {
        WireHelper::reset();
        $html = $this->twig->render($template, $context);
        preg_match('/<script type="wire">(.*?)<\/script>/s', $html, $m);
        $this->assertNotEmpty($m, "No wire script tag found in $template");
        return json_decode($m[1], true);
    }
}
