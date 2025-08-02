// Placeholder decorators - these will be implemented to make the tests pass
export function signal<T>(options?: any): PropertyDecorator;
export function signal<T>(target: any, propertyKey: string | symbol): void;
export function signal<T>(
  targetOrOptions?: any,
  propertyKey?: string | symbol
): PropertyDecorator | void {
  // This is a placeholder - will be implemented
  throw new Error('@signal decorator not implemented yet');
}

export function derived<T>(options?: any): PropertyDecorator;
export function derived<T>(target: any, propertyKey: string | symbol): void;
export function derived<T>(
  targetOrOptions?: any,
  propertyKey?: string | symbol
): PropertyDecorator | void {
  // This is a placeholder - will be implemented
  throw new Error('@derived decorator not implemented yet');
}
