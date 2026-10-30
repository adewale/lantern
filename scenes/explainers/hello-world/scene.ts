import { Scene, Text, FadeIn } from '../../../src/index.ts';

export default class HelloWorld extends Scene {
  static meta = { id: 'hello-world', title: 'Hello, world!' };
  override async construct() {
    await this.step('hello', { title: 'Hello, world!', caption: 'The picture says “Hello, world!”.' });
    await this.play(new FadeIn(new Text('Hello, world!', { fontSize: 1.2 })));
  }
}
