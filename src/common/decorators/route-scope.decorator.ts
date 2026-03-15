import { SetMetadata } from '@nestjs/common';
import { ROUTE_SCOPE_KEY } from '../common.constants';
import type { RequestScope } from '../common.types';

export const RouteScope = (scope: RequestScope) =>
  SetMetadata(ROUTE_SCOPE_KEY, scope);
