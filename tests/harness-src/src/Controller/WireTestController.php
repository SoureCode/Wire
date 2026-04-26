<?php

namespace App\Controller;

use App\Entity\User;
use Doctrine\ORM\EntityManagerInterface;
use Doctrine\ORM\Tools\SchemaTool;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\Routing\Attribute\Route;

#[Route('/wire-test')]
class WireTestController extends AbstractController
{
    #[Route('/user/{id}', name: 'wire_test_user')]
    public function user(int $id, EntityManagerInterface $em): Response
    {
        $user = $em->find(User::class, $id);
        if (!$user) {
            throw $this->createNotFoundException();
        }

        return $this->render('wire_test/user.html.twig', ['user' => $user]);
    }

    #[Route('/api/user/{id}', name: 'wire_test_api_user_read', methods: ['GET'])]
    public function apiUserRead(int $id, EntityManagerInterface $em): \Symfony\Component\HttpFoundation\JsonResponse
    {
        $user = $em->find(\App\Entity\User::class, $id);
        if (!$user) {
            throw $this->createNotFoundException();
        }

        return new \Symfony\Component\HttpFoundation\JsonResponse([
            '__class' => \App\Entity\User::class,
            '__id'    => $user->id,
            'name'    => $user->name,
            'email'   => $user->email,
            'status'  => $user->status,
        ]);
    }

    #[Route('/api/user/{id}', name: 'wire_test_api_user_update', methods: ['PATCH'])]
    public function apiUserUpdate(int $id, \Symfony\Component\HttpFoundation\Request $request, EntityManagerInterface $em): \Symfony\Component\HttpFoundation\JsonResponse
    {
        $user = $em->find(\App\Entity\User::class, $id);
        if (!$user) {
            throw $this->createNotFoundException();
        }

        $body = json_decode($request->getContent(), true) ?? [];
        if (isset($body['name'])) {
            $user->name = $body['name'];
        }
        if (isset($body['email'])) {
            $user->email = $body['email'];
        }
        if (isset($body['status'])) {
            $user->status = $body['status'];
        }
        $em->flush();

        return new \Symfony\Component\HttpFoundation\JsonResponse([
            '__class' => \App\Entity\User::class,
            '__id'    => $user->id,
            'name'    => $user->name,
            'email'   => $user->email,
            'status'  => $user->status,
        ]);
    }

    #[Route('/entity-methods/{id}', name: 'wire_test_entity_methods')]
    public function entityMethods(int $id, EntityManagerInterface $em): Response
    {
        $user = $em->find(\App\Entity\User::class, $id);
        if (!$user) {
            throw $this->createNotFoundException();
        }

        return $this->render('wire_test/entity_methods.html.twig', ['user' => $user]);
    }

    #[Route('/entity-methods-fixture', name: 'wire_test_entity_methods_fixture', methods: ['GET'])]
    public function entityMethodsFixture(EntityManagerInterface $em): Response
    {
        $metadata = [$em->getClassMetadata(\App\Entity\User::class)];
        $schemaTool = new SchemaTool($em);
        $schemaTool->dropSchema($metadata);
        $schemaTool->createSchema($metadata);

        $user = new \App\Entity\User('Alice', 'alice@example.com', 'active');
        $em->persist($user);
        $em->flush();

        return $this->redirectToRoute('wire_test_entity_methods', ['id' => $user->id]);
    }

    #[Route('/full/{id}', name: 'wire_test_full')]
    public function full(int $id, EntityManagerInterface $em): Response
    {
        $user = $em->find(User::class, $id);
        if (!$user) {
            throw $this->createNotFoundException();
        }

        return $this->render('wire_test/full.html.twig', ['user' => $user]);
    }

    #[Route('/full-fixture', name: 'wire_test_full_fixture', methods: ['GET'])]
    public function fullFixture(EntityManagerInterface $em): Response
    {
        $metadata = [$em->getClassMetadata(User::class)];
        $schemaTool = new SchemaTool($em);
        $schemaTool->dropSchema($metadata);
        $schemaTool->createSchema($metadata);

        $user = new User('Jason', 'jason@example.com', 'active');
        $em->persist($user);
        $em->flush();

        return $this->redirectToRoute('wire_test_full', ['id' => $user->id]);
    }

    #[Route('/cross-scope/{id}', name: 'wire_test_cross_scope')]
    public function crossScope(int $id, EntityManagerInterface $em): Response
    {
        $user = $em->find(User::class, $id);
        if (!$user) {
            throw $this->createNotFoundException();
        }

        return $this->render('wire_test/cross_scope.html.twig', ['user' => $user]);
    }

    #[Route('/cross-scope-fixture', name: 'wire_test_cross_scope_fixture', methods: ['GET'])]
    public function crossScopeFixture(EntityManagerInterface $em): Response
    {
        $metadata = [$em->getClassMetadata(User::class)];
        $schemaTool = new SchemaTool($em);
        $schemaTool->dropSchema($metadata);
        $schemaTool->createSchema($metadata);

        $user = new User('Jason', 'jason@example.com', 'active');
        $em->persist($user);
        $em->flush();

        return $this->redirectToRoute('wire_test_cross_scope', ['id' => $user->id]);
    }

    #[Route('/multi', name: 'wire_test_multi')]
    public function multi(EntityManagerInterface $em): Response
    {
        $users = $em->getRepository(User::class)->findAll();

        return $this->render('wire_test/multi.html.twig', ['users' => $users]);
    }

    #[Route('/multi-fixture', name: 'wire_test_multi_fixture', methods: ['GET'])]
    public function multiFixture(EntityManagerInterface $em): Response
    {
        $metadata = [$em->getClassMetadata(User::class)];
        $schemaTool = new SchemaTool($em);
        $schemaTool->dropSchema($metadata);
        $schemaTool->createSchema($metadata);

        foreach ([
            new User('Alice', 'alice@example.com', 'active'),
            new User('Bob', 'bob@example.com', 'inactive'),
            new User('Carol', 'carol@example.com', 'active'),
        ] as $user) {
            $em->persist($user);
        }

        $em->flush();

        return $this->redirectToRoute('wire_test_multi');
    }

    #[Route('/cascade/{id}', name: 'wire_test_cascade')]
    public function cascade(int $id, EntityManagerInterface $em): Response
    {
        $user = $em->find(User::class, $id);
        if (!$user) {
            throw $this->createNotFoundException();
        }

        return $this->render('wire_test/cascade_parent.html.twig', ['user' => $user]);
    }

    #[Route('/cascade-fixture', name: 'wire_test_cascade_fixture', methods: ['GET'])]
    public function cascadeFixture(EntityManagerInterface $em): Response
    {
        $metadata = [$em->getClassMetadata(User::class)];
        $schemaTool = new SchemaTool($em);
        $schemaTool->dropSchema($metadata);
        $schemaTool->createSchema($metadata);

        $user = new User('Jason', 'jason@example.com', 'active');
        $em->persist($user);
        $em->flush();

        return $this->redirectToRoute('wire_test_cascade', ['id' => $user->id]);
    }

    #[Route('/fixture', name: 'wire_test_fixture', methods: ['GET'])]
    public function fixture(EntityManagerInterface $em): Response
    {
        $metadata = [$em->getClassMetadata(User::class)];
        $schemaTool = new SchemaTool($em);
        $schemaTool->dropSchema($metadata);
        $schemaTool->createSchema($metadata);

        $user = new User('Jason', 'jason@example.com', 'active');
        $em->persist($user);
        $em->flush();

        return $this->redirectToRoute('wire_test_user', ['id' => $user->id]);
    }
}
