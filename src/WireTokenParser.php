<?php

namespace SoureCode\Wire;

use Twig\Node\Expression\ArrayExpression;
use Twig\Node\Expression\ConstantExpression;
use Twig\Node\Node;
use Twig\Token;
use Twig\TokenParser\AbstractTokenParser;

/**
 * Parses:
 *
 *   {% wire %}
 *   {% wire cascade %}
 *   {% wire groups=['admin', 'detail'] %}
 *   {% wire cascade groups=['admin'] %}
 */
class WireTokenParser extends AbstractTokenParser
{
    public function parse(Token $token): Node
    {
        $stream  = $this->parser->getStream();
        $cascade = false;
        $groups  = [];

        while (!$stream->test(Token::BLOCK_END_TYPE)) {
            if ($stream->test(Token::NAME_TYPE, 'cascade')) {
                $stream->next();
                $cascade = true;
                continue;
            }

            if ($stream->test(Token::NAME_TYPE, 'groups')) {
                $stream->next();
                $stream->expect(Token::OPERATOR_TYPE, '=');
                $expr   = $this->parser->getExpressionParser()->parseExpression();
                $groups = $this->extractStringList($expr);
                continue;
            }

            break;
        }

        $stream->expect(Token::BLOCK_END_TYPE);

        return new WireOptInNode($token->getLine(), $cascade, $groups);
    }

    public function getTag(): string
    {
        return 'wire';
    }

    /**
     * @return string[]
     */
    private function extractStringList(Node $expr): array
    {
        if (!$expr instanceof ArrayExpression) {
            throw new \LogicException('{% wire groups=... %} expects an array of strings');
        }

        $values = [];
        foreach ($expr as $key => $child) {
            if ($key % 2 === 0) {
                continue;
            }
            if (!$child instanceof ConstantExpression) {
                throw new \LogicException('{% wire groups=[...] %} expects literal string entries');
            }
            $value = $child->getAttribute('value');
            if (!is_string($value)) {
                throw new \LogicException('{% wire groups=[...] %} expects literal string entries');
            }
            $values[] = $value;
        }

        return $values;
    }
}
