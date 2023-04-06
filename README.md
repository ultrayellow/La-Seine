# La Seine

Simple 42 api request library with rate limit management.

## Install

```
npm i la-seine
```

```
pnpm add la-seine
```

## Usage

```ts
import seine from 'seine';

await seine.addApiClient({
  clientId: 'id-string',
  clientSecret: 'secret-string',
});

for (let i = 0; i < 10; i++) {
  seine.addRequest('https://api.intra.42.fr/v2/users?page[number]=' + i);
}

const result = await seine.getResult();

if (result.status === 'success') {
  for (const response of result.responses) {
    const data = await response.json();
    console.log(data);
  }
}
```
