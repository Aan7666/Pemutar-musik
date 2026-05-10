import { ComponentFixture, TestBed } from '@angular/core/testing';
import { PermissionPage } from './permission.page';

describe('PermissionPage', () => {
  let component: PermissionPage;
  let fixture: ComponentFixture<PermissionPage>;

  beforeEach(() => {
    fixture = TestBed.createComponent(PermissionPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
