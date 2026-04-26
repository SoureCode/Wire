<?php

require_once __DIR__ . '/../vendor/autoload.php';

$loader = new \Twig\Loader\FilesystemLoader(__DIR__ . '/templates');
$twig = new \Twig\Environment($loader, ['debug' => true]);
$twig->addExtension(new \SoureCode\Wire\WireExtension());

$person = new stdClass();
$person->name = 'Jason';
$person->email = 'jason@example.com';
$person->status = 'active';

$address = new stdClass();
$address->street = '123 Main St';
$address->city = 'Berlin';
$address->zip = '10115';

$summary = new stdClass();
$summary->total = 99.99;

$cart = [
    'total'     => 99.99,
    'itemCount' => 2,
    'owner'     => $person,
    'summary'   => $summary,
    'items'     => [
        ['name' => 'Shoes', 'price' => 49.99, 'quantity' => 1],
        ['name' => 'Hat',   'price' => 50.00, 'quantity' => 1],
    ],
];

\SoureCode\Wire\WireHelper::reset();
echo $twig->render('poc.html.twig', [
    'user'    => $person,
    'address' => $address,
    'cart'    => $cart,
]);
