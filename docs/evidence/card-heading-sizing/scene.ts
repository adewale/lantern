import { Scene } from 'rayner';
import { stage } from 'rayner/explain';

export default class CardSizing extends Scene {
  static meta = { id: 'card-sizing', title: 'Uncapped single-column card' };
  override async construct() {
    const s = stage(this, { style: 'nord', heading: false });
    await this.step('heading', { title: 'Preserve the authored heading size' });
    await s.card([['Hits', 1]], {
      columns: ['Average lookup latency (milliseconds)'],
      fontSize: 0.45,
    });
  }
}
