import {Scene} from 'rayner';
import {stage} from 'rayner/explain';

export default class LayoutDirection extends Scene {
  static meta = {
    id: 'layout-direction',
    title: 'Choose where a panel starts',
    sources: ['https://github.com/adewale/rayner/blob/main/docs/REFERENCE.md#stage'],
  };

  override async construct() {
    const s = stage(this, {style: 'nord', direction: 'rtl', headingSize: 0.6});
    await this.step('columns', {
      title: 'Start is on the right',
      line: 'The left card overrides the stage’s field order.',
      caption: 'Start is the right card; End is the left card. Field and 123 trade sides because the left card requests left-to-right columns. Both numbers still read 123.',
    });
    const start = await s.card([['Field', 123]], {at: 'start', title: 'RTL at start', width: 7.2, fontSize: 0.8, enter: false});
    const end = await s.card([['Field', 123]], {at: 'end', direction: 'ltr', title: 'LTR at end', width: 7.2, fontSize: 0.8, enter: false});
    await s.enter(start, end);

    await this.step('updates', {
      title: 'Updates keep their column',
      line: 'The marked rows keep their positions as values change.',
      caption: 'Both marked rows now show 456. The right card keeps its label on the right, and the left card keeps its label on the left.',
    });
    await start.set({Field: 456});
    await end.set({Field: 456});
    await start.mark('Field', {as: 'updated'});
    await end.mark('Field', {as: 'updated'});
  }
}
