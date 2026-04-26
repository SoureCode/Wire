<?php

namespace App\Tests\Integration;

use App\Entity\Address;
use App\Entity\User;

class WireDoctrineProxyTest extends WireIntegrationTestCase
{
    public function testGhostProxyIsInitializedAndExtracted(): void
    {
        $user = new User('Proxy User', 'proxy@example.com');
        $this->em->persist($user);
        $this->em->flush();
        $id = $user->id;

        $this->em->clear();
        $proxy = $this->em->getReference(User::class, $id);

        $data = $this->wireData('wire_test/user.html.twig', ['user' => $proxy]);
        $this->assertSame('Proxy User', $data['user']['name']);
        $this->assertSame('proxy@example.com', $data['user']['email']);
        $this->assertSame(User::class, $data['user']['__class']);
        $this->assertSame($id, $data['user']['__id']);
    }

    public function testGhostProxyInTwoScopesProducesRef(): void
    {
        $user = new User('Ghost', 'ghost@example.com');
        $this->em->persist($user);
        $this->em->flush();
        $id = $user->id;

        $this->em->clear();
        $proxy = $this->em->getReference(User::class, $id);

        $scopes = $this->wireDataAll('wire_test/cross_scope.html.twig', ['user' => $proxy]);
        $this->assertCount(2, $scopes);
        $this->assertArrayHasKey('$ref', $scopes[1]['user']);
        $this->assertSame('wire_test/_cross_a.html.twig#user', $scopes[1]['user']['$ref']);
    }

    public function testLazyManyToOneProxyIsInitializedByWire(): void
    {
        $address = new Address('Main St', 'Munich', '80333');
        $user    = new User('Lazy', 'lazy@example.com');
        $user->address = $address;

        $this->em->persist($address);
        $this->em->persist($user);
        $this->em->flush();
        $userId = $user->id;

        $this->em->clear();
        $proxy = $this->em->find(User::class, $userId);

        $data = $this->wireData('wire_test/user_relations.html.twig', ['user' => $proxy]);
        $this->assertSame('Munich', $data['user']['address']['city']);
        $this->assertSame('Main St', $data['user']['address']['street']);
    }

    public function testDoctrineIdentityMapSharedAddressCarriesSameIdentity(): void
    {
        $address = new Address('Same St', 'Cologne', '50667');
        $user1   = new User('A', 'a@example.com');
        $user2   = new User('B', 'b@example.com');
        $user1->address = $address;
        $user2->address = $address;

        $this->em->persist($address);
        $this->em->persist($user1);
        $this->em->persist($user2);
        $this->em->flush();

        $this->em->clear();
        $a = $this->em->find(User::class, $user1->id);
        $b = $this->em->find(User::class, $user2->id);

        $scopes = $this->wireDataAll('wire_test/multi.html.twig', ['users' => [$a, $b]]);
        $this->assertCount(2, $scopes);
        $this->assertSame(
            $scopes[0]['user']['address']['__id'],
            $scopes[1]['user']['address']['__id']
        );
    }
}
