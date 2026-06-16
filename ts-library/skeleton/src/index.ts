export interface GreetOptions {
  name: string;
}

export function greet(options: GreetOptions): string {
  return `Hello, ${options.name}`;
}
