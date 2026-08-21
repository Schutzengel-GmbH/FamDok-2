import { Pipe, PipeTransform } from '@angular/core';
import { AnonUser, FullUser } from '../../../../shared/types';
import { userPipe } from '../util/tableTransformPipes';

@Pipe({
  name: 'user',
  standalone: true,
})
export class UserPipe implements PipeTransform {
  transform(user: FullUser | AnonUser) {
    return userPipe.transform(user);
  }
}
