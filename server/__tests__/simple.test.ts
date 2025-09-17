import { describe, it, expect } from 'vitest';

describe('Simple QA Test', () => {
  it('should verify basic math works', () => {
    expect(2 + 2).toBe(4);
  });

  it('should verify string operations work', () => {
    const greeting = 'Hello';
    const name = 'World';
    expect(`${greeting} ${name}`).toBe('Hello World');
  });

  it('should verify array operations work', () => {
    const numbers = [1, 2, 3];
    expect(numbers.length).toBe(3);
    expect(numbers.includes(2)).toBe(true);
  });

  it('should verify object operations work', () => {
    const user = { name: 'John', age: 30 };
    expect(user.name).toBe('John');
    expect(user.age).toBe(30);
  });

  it('should verify async operations work', async () => {
    const promise = Promise.resolve('success');
    const result = await promise;
    expect(result).toBe('success');
  });
});