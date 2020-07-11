import { Given, When, Then } from 'cucumber';

let And = When;

// globals for now
let left = 0;
let right = 0;
let result = 0;

Given('I take the number {int}', (n: number) => {
  left = Number(n);
});

When('I take the number {int}', (n: number) => {
  right = Number(n);
});

And('I add them', () => {
  result = left + right;
});

Then('I will have {int}', () => {
  console.log(`the result is ${result}`);
});

// import { Given, When, Then } from 'cucumber';
// // import { App } from '@bigtest/interactor';

// let And = When;

// Given('I take the number {int}', (n: number) => {
//   return { left: Number(n) };
// });

// When('I take the number {int}', (n: number) => {
//   return { right: Number(n) };
// });

// And('I add them', ({ left, right }) => {
//   return { result: left + right };
// });

// Then('I will have {int}', ({ result }) => {
//   console.log(`the result is ${result}`);
// });
