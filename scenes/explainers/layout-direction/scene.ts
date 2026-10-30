import {Scene} from 'rayner';
import {stage} from 'rayner/explain';

export default class LayoutDirection extends Scene {
  static meta = {
    id: 'layout-direction',
    title: 'The stage places cards; each card orders its fields',
    sources: ['https://github.com/adewale/rayner/blob/main/docs/REFERENCE.md#stage'],
  };

  override async construct() {
    const s = stage(this, {style: 'nord', direction: 'rtl', headingSize: 0.6});
    await this.step('columns', {
      title: 'The stage’s start is on the right',
      line: 'The End card orders its fields left-to-right instead.',
      caption: 'The right-to-left stage places Start on the right and End on the left. End overrides its field columns to left-to-right, so Field and 123 trade sides without reversing the digits.',
    });
    const start = await s.card([['Field', 123]], {at: 'start', title: 'RTL at start', width: 7.2, fontSize: 0.8, enter: false});
    const end = await s.card([['Field', 123]], {at: 'end', direction: 'ltr', title: 'LTR at end', width: 7.2, fontSize: 0.8, enter: false});
    await s.enter(start, end);

    await this.step('updates', {
      title: 'Changing a value does not reorder the fields',
      line: 'Both values become 456; the columns stay put.',
      caption: 'Both cards change 123 to 456. Start keeps Field on the right, while End keeps it on the left because each card retains its own column direction.',
    });
    await start.set({Field: 456});
    await end.set({Field: 456});
    await start.mark('Field', {as: 'updated'});
    await end.mark('Field', {as: 'updated'});
  }
}
