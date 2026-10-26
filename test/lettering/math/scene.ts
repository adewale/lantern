import {Scene,Math} from 'rayner';
import {stage} from 'rayner/explain';
export default class Example extends Scene {
  static meta = {id: 'lettering-math', title: "Math", lettering: {math:true}};
  override async construct() {
    const s = stage(this, {heading: false});
    await this.step('example', {title: "Math", caption: "Math"});
    await s.enter(new Math("\\frac{1}{2}+x^2", {color: s.palette.ink}));
  }
}
