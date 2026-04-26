<?php

namespace App\Tests\Integration;

use App\Entity\Address;
use App\Entity\User;

class WireRelationshipTest extends WireIntegrationTestCase
{
    public function testManyToOneAddressNormalized(): void
    {
        $address = new Address('123 Main St', 'Berlin', '10115');
        $user    = new User('Jason', 'jason@example.com');
        $user->address = $address;

        $this->em->persist($address);
        $this->em->persist($user);
        $this->em->flush();

        $data = $this->wireData('wire_test/user_relations.html.twig', ['user' => $user]);
        $this->assertSame('Berlin', $data['user']['address']['city']);
        $this->assertSame('123 Main St', $data['user']['address']['street']);
    }

    public function testNestedEntityCarriesIdentityTag(): void
    {
        $address = new Address('123 Main St', 'Berlin', '10115');
        $user    = new User('Jason', 'jason@example.com');
        $user->address = $address;

        $this->em->persist($address);
        $this->em->persist($user);
        $this->em->flush();

        $data = $this->wireData('wire_test/user_relations.html.twig', ['user' => $user]);
        $this->assertSame(Address::class, $data['user']['address']['__class']);
        $this->assertSame($address->id, $data['user']['address']['__id']);
    }

    public function testNullManyToOneSerializesAsNull(): void
    {
        $user = new User('NoAddr', 'noaddr@example.com');
        $this->em->persist($user);
        $this->em->flush();

        $data = $this->wireData('wire_test/user_relations.html.twig', ['user' => $user]);
        $this->assertArrayHasKey('address', $data['user']);
        $this->assertNull($data['user']['address']);
    }

    public function testSameAddressInTwoCardsCarriesSameIdentity(): void
    {
        $address = new Address('Shared St', 'Hamburg', '20095');
        $user1   = new User('User1', 'u1@example.com');
        $user2   = new User('User2', 'u2@example.com');
        $user1->address = $address;
        $user2->address = $address;

        $this->em->persist($address);
        $this->em->persist($user1);
        $this->em->persist($user2);
        $this->em->flush();

        $scopes = $this->wireDataAll('wire_test/multi.html.twig', ['users' => [$user1, $user2]]);
        $this->assertCount(2, $scopes);
        $this->assertSame(
            $scopes[0]['user']['address']['__id'],
            $scopes[1]['user']['address']['__id']
        );
        $this->assertSame(
            $scopes[0]['user']['address']['__class'],
            $scopes[1]['user']['address']['__class']
        );
    }
}
