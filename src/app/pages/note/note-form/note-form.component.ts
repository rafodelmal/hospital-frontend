// ANGULAR
import {FormBuilder, FormGroup, Validators} from '@angular/forms';
import {Component, OnDestroy, OnInit} from '@angular/core';
// RXJS
import {BehaviorSubject, forkJoin, Subscription} from 'rxjs';
import {debounceTime, filter, finalize, shareReplay, startWith, switchMap, tap} from 'rxjs/operators';
// NGRX
import * as noteActions from '../+state/note.actions';
import {State} from '../../../reducers';
import {ActionsSubject, Store} from '@ngrx/store';
// SERVICES
import {DoctorService} from '../../doctor/services/doctor.service';
import {PatientService} from '../../patient/services/patient.service';

@Component({
  selector: 'note-form',
  templateUrl: './note-form.component.html'
})

export class NoteFormComponent implements OnInit, OnDestroy {

  form: FormGroup;

  // SUBS
  actionSubs: Subscription[] = [];

  // LOADER VARS
  isLoadingSave = new BehaviorSubject<boolean>(false);

  // SIDENAV FORM TYPE SUBS
  sidenavFormType$ = this.store.select(s => s.appNote.sidenavFormType).pipe(shareReplay());
  sidenavFormTypeSubs: Subscription;
  sidenavFormType: string;

  doctors = [];
  isLoadingIdDoctor = new BehaviorSubject<boolean>(false);

  patients = [];
  isLoadingIdPatient = new BehaviorSubject<boolean>(false);

  constructor(private formBuilder: FormBuilder,
              private store: Store<State>,
              private actions: ActionsSubject,
              private patientService: PatientService,
              private doctorService: DoctorService) {

  }

  ngOnInit(): void {

    // CONFIG FORM
    this.form = this.formBuilder.group({
      id: null,
      idDoctor: [null, [Validators.required]],
      idPatient: [null, [Validators.required]],
      date: [null, [Validators.required]],
      description: [null, [Validators.required]],
    });

    // GET NOTE SUCCESS
    this.actionSubs.push(this.actions.pipe(
      filter(s => s.type === noteActions.GetNoteSuccess.type),
      tap((s: any) => {
        const form = Object.assign({}, s.entity.body);
        forkJoin([
          this.doctorService.getById(form.idDoctor),
          this.patientService.getById(form.idPatient)
        ]).subscribe(
          res => this.form.setValue({
            id: form.id,
            idDoctor: res[0].body,
            idPatient: res[1].body,
            date: form.date,
            description: form.description
          }),
          error => this.form.setValue({
            id: form.id,
            idDoctor: {firstName: '---', lastName: '---'},
            idPatient: {firstName: '---', lastName: '---'},
            date: form.date,
            description: form.description
          })
        );
      })
    ).subscribe());

    // UPDATE OR ADD NOTE SUCCESS
    this.actionSubs.push(this.actions.pipe(
      filter(s =>
        s.type === noteActions.AddSuccess.type ||
        s.type === noteActions.UpdateSuccess.type),
      tap((s) => {
        this.isLoadingSave.next(false);
        this.closeSidenav();
      })
    ).subscribe());

    // UPDATE OR ADD NOTE FAILURE
    this.actionSubs.push(this.actions.pipe(
      filter(s =>
        s.type === noteActions.AddFailure.type ||
        s.type === noteActions.UpdateFailure.type),
      tap(() => {
        this.isLoadingSave.next(false);
      })
    ).subscribe());

    // SIDENAV FORM TYPE SUBS
    this.sidenavFormTypeSubs = this.sidenavFormType$.pipe(
      tap(s => {
        this.form.reset();
        this.sidenavFormType = s;
      })).subscribe();

    // PATIENT FIELD SUBS
    this.form.get('idPatient').valueChanges.pipe(
      debounceTime(1000),
      startWith(''),
      tap(() => this.isLoadingIdPatient.next(true)),
      switchMap(value => this.patientService.list({
          firstName: {value: value, type: 'contains'},
          page: 0,
          size: 50,
          sort: null
        }).pipe(finalize(() => this.isLoadingIdPatient.next(false)))
      )
    ).subscribe(res => this.patients = res.body);

    // DOCTOR FIELD SUBS
    this.form.get('idDoctor').valueChanges.pipe(
      debounceTime(1000),
      startWith(''),
      tap(() => this.isLoadingIdDoctor.next(true)),
      switchMap(value => this.doctorService.list({
          firstName: {value: value, type: 'contains'},
          page: 0,
          size: 50,
          sort: null
        }).pipe(finalize(() => this.isLoadingIdDoctor.next(false)))
      )
    ).subscribe(res => this.doctors = res.body);

  }

  ngOnDestroy(): void {
    this.actionSubs.forEach(subs => subs.unsubscribe());
  }

  onSave(): void {
    this.isLoadingSave.next(true);
    const auxFormValue = Object.assign({}, this.form.value);
    auxFormValue.idPatient = auxFormValue.idPatient.id;
    auxFormValue.idDoctor = auxFormValue.idDoctor.id;

    if (this.sidenavFormType === 'new') {
      this.store.dispatch(noteActions.AddAction({entity: auxFormValue}));
    }
    if (this.sidenavFormType === 'edit') {
      this.store.dispatch(noteActions.UpdateAction({entity: auxFormValue}));
    }
  }

  closeSidenav(): void {
    this.store.dispatch(noteActions.CloseSidenav());
  }

  displayFn(data?: any): string | undefined {
    return data ? data.firstName + '-' + data.lastName : undefined;
  }
}
