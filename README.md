# manta-shortener

`manta-shortener` is a URL shortening service, optionally backed by [Manta][manta].

[manta]: https://github.com/joyent/manta

## API

### ShortenURL (GET /s; POST /)

Get a short link.

#### Inputs

| Field | Type   | Description |
| ----- | ------ | ----------- |
| url   | string | URL target  |

#### Example

    GET /s?url=https://www.joyent.com/
    {
      "url": "https://www.joyent.com/",
      "link": "http://localhost:8080/8553696207"
    }

<!-- -->

    POST /
        -d url=https://www.joyent.com/
    {
      "url": "https://www.joyent.com/",
      "link": "http://localhost:8080/8553696207"
    }

### ExpandURL (GET /:key)

Redirect short URL to URL target

#### Inputs

| Field | Type   | Description |
| ----- | ------ | ----------- |
| key   | number | short url   |

#### Example

    GET /8553696207
    HTTP/1.1 302 Found
    Location: https://www.joyent.com/

### PreviewURL (GET /:key)

Retrieve target URL without redirection.

#### Inputs

| Field   | Type    | Description                   |
| ------- | ------- | -----------                   |
| key     | number  | short url                     |
| preview | boolean | Must be set `true` to preview |

#### Example

    GET /8553696207?preview=true
    HTTP/1.1 200 OK
    
    {
      "location": "https://www.joyent.com/"
    }
