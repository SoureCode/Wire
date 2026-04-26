<?php

namespace SoureCode\Wire;

use Twig\Token;
use Twig\TokenParser\AbstractTokenParser;
use Twig\Node\Node;

class WireTokenParser extends AbstractTokenParser
{
    public function parse(Token $token): Node
    {
        $stream = $this->parser->getStream();
        $cascade = false;

        if ($stream->test(Token::NAME_TYPE, 'cascade')) {
            $stream->next();
            $cascade = true;
        }

        $stream->expect(Token::BLOCK_END_TYPE);

        return new WireOptInNode($token->getLine(), $cascade);
    }

    public function getTag(): string
    {
        return 'wire';
    }
}
