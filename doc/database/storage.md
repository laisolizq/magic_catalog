We need a very compact offline database to store the information we want to display on the list of all magic cards.
This database must be updated in patches and not fully downloaded every time there is an update.
Must have indexes to find cards by name fast and by set/color/rarity.

Allso we want the thumbnails images of the standard legal (most recent) cards downloaded.
And highres image of the last 1000 queried cards in the cache.

Implement fuzzy search by name, Esteve normally misspells the card names

----



Standard format contains 5000 cards. If we want to display a small crop and some info we will be at least 10kb for card.

5000 * 10 Kb = 50000 Kb = 50 Mb

This is huge but acceptable, as it should download in arround 10 seconds.

If we want to have structured data of all magic cards.
Unique Names: ~35,500 distinct card titles.
Paper Printings & Variants: ~84,000 to 90,000 unique physical versions when including special treatments and art variations.

35.000 * 2 Kb = 70000 Kb, 70Mb aditional, it starts to hurt downloading so much data.

For card structured data, we must have a DB with pathced updates, we don't want to download the full database every time between updates.


----

Main purpose: review limited set cards
Also: search for a card by cardname, even implemeting part of the scryfall search api

Information to show on the lists:
Does not have to be explicit but:
+ color (framing)
+ mana cost
+ name
+ type
+ power
+ thoughness
+ oracle text

We might want to use future sight set iconografphy for types and mana
Oracle text, do not show, show just one line, on hover